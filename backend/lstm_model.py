"""
Netra — LSTM Deep Learning Model
Sequence-based price direction prediction using LSTM neural network.
Captures temporal patterns that tree-based models miss.
"""

import logging
import json
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score
import joblib

from config import MODEL_DIR
from data_fetcher import get_stock_df
from indicators import calculate_all_indicators
from model import FEATURE_COLS

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logger.warning("PyTorch not installed — LSTM model unavailable")

SEQUENCE_LENGTH = 20  # Look back 20 trading days
LSTM_HIDDEN_SIZE = 64
LSTM_NUM_LAYERS = 2
LSTM_DROPOUT = 0.3
LSTM_EPOCHS = 50
LSTM_BATCH_SIZE = 64
LSTM_LR = 0.001


if HAS_TORCH:
    class PriceLSTM(nn.Module):
        """LSTM network for binary classification (up/down)."""

        def __init__(self, input_size: int, hidden_size: int = LSTM_HIDDEN_SIZE,
                     num_layers: int = LSTM_NUM_LAYERS, dropout: float = LSTM_DROPOUT):
            super().__init__()
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                dropout=dropout if num_layers > 1 else 0,
                batch_first=True,
            )
            self.fc = nn.Sequential(
                nn.Linear(hidden_size, 32),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(32, 1),
                nn.Sigmoid(),
            )

        def forward(self, x):
            lstm_out, _ = self.lstm(x)
            last_hidden = lstm_out[:, -1, :]  # Take last time step
            return self.fc(last_hidden).squeeze(-1)


def _create_sequences(X: np.ndarray, y: np.ndarray, seq_len: int = SEQUENCE_LENGTH) -> Tuple[np.ndarray, np.ndarray]:
    """Create sliding window sequences from feature matrix."""
    X_seq, y_seq = [], []
    for i in range(seq_len, len(X)):
        X_seq.append(X[i - seq_len:i])
        y_seq.append(y[i])
    return np.array(X_seq), np.array(y_seq)


def train_lstm(symbol: str) -> Optional[dict]:
    """
    Train an LSTM model for a stock symbol.
    Returns metrics dict or None on failure.
    """
    if not HAS_TORCH:
        logger.error("PyTorch not installed — cannot train LSTM")
        return None

    logger.info("Training LSTM for %s", symbol)

    # Get data
    stock_df = get_stock_df(symbol)
    if stock_df.empty:
        return None

    indicators_df = calculate_all_indicators(stock_df)
    if indicators_df.empty or len(indicators_df) < 300:
        logger.warning("Insufficient data for LSTM: %s (%d rows)", symbol, len(indicators_df))
        return None

    # Prepare features
    df = indicators_df.copy()
    df["target"] = (df["close"].shift(-1) > df["close"]).astype(int)
    df = df.dropna()

    available_features = [c for c in FEATURE_COLS if c in df.columns]
    X = df[available_features].values
    y = df["target"].values

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Create sequences
    X_seq, y_seq = _create_sequences(X_scaled, y)

    if len(X_seq) < 100:
        logger.warning("Too few sequences for %s: %d", symbol, len(X_seq))
        return None

    # Train/test split (80/20, preserving time order)
    split_idx = int(len(X_seq) * 0.8)
    X_train, X_test = X_seq[:split_idx], X_seq[split_idx:]
    y_train, y_test = y_seq[:split_idx], y_seq[split_idx:]

    # Convert to tensors
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    X_train_t = torch.FloatTensor(X_train).to(device)
    y_train_t = torch.FloatTensor(y_train).to(device)
    X_test_t = torch.FloatTensor(X_test).to(device)
    y_test_t = torch.FloatTensor(y_test).to(device)

    train_dataset = TensorDataset(X_train_t, y_train_t)
    train_loader = DataLoader(train_dataset, batch_size=LSTM_BATCH_SIZE, shuffle=False)

    # Build model
    model = PriceLSTM(input_size=len(available_features)).to(device)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LSTM_LR, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    # Training loop
    best_f1 = 0
    patience_counter = 0
    for epoch in range(LSTM_EPOCHS):
        model.train()
        epoch_loss = 0
        for X_batch, y_batch in train_loader:
            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item()

        # Evaluate
        model.eval()
        with torch.no_grad():
            test_outputs = model(X_test_t)
            test_preds = (test_outputs > 0.5).float().cpu().numpy()
            test_probs = test_outputs.cpu().numpy()
            val_f1 = f1_score(y_test, test_preds, zero_division=0)

        scheduler.step(epoch_loss)

        # Early stopping
        if val_f1 > best_f1:
            best_f1 = val_f1
            patience_counter = 0
            # Save best model state
            best_state = model.state_dict().copy()
        else:
            patience_counter += 1
            if patience_counter >= 10:
                logger.info("LSTM early stopping at epoch %d", epoch + 1)
                break

    # Load best model
    model.load_state_dict(best_state)
    model.eval()

    # Final evaluation
    with torch.no_grad():
        test_outputs = model(X_test_t)
        test_preds = (test_outputs > 0.5).float().cpu().numpy()
        test_probs = test_outputs.cpu().numpy()

    metrics = {
        "symbol": symbol,
        "accuracy": float(accuracy_score(y_test, test_preds)),
        "f1_score": float(f1_score(y_test, test_preds, zero_division=0)),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "epochs_trained": epoch + 1,
    }

    # Save model, scaler, and metrics
    safe_name = symbol.replace(".", "_").replace("^", "IDX_")
    model_path = MODEL_DIR / f"{safe_name}_lstm.pt"
    scaler_path = MODEL_DIR / f"{safe_name}_lstm_scaler.joblib"
    metrics_path = MODEL_DIR / f"{safe_name}_lstm_metrics.json"

    torch.save({
        "model_state": model.state_dict(),
        "input_size": len(available_features),
        "features": available_features,
    }, model_path)
    joblib.dump(scaler, scaler_path)
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info("LSTM %s — Accuracy: %.4f, F1: %.4f", symbol, metrics["accuracy"], metrics["f1_score"])
    return metrics


def load_lstm(symbol: str) -> Optional[Tuple]:
    """Load trained LSTM model and scaler. Returns (model, scaler, features) or None."""
    if not HAS_TORCH:
        return None

    safe_name = symbol.replace(".", "_").replace("^", "IDX_")
    model_path = MODEL_DIR / f"{safe_name}_lstm.pt"
    scaler_path = MODEL_DIR / f"{safe_name}_lstm_scaler.joblib"

    if not model_path.exists() or not scaler_path.exists():
        return None

    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
    model = PriceLSTM(input_size=checkpoint["input_size"])
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    scaler = joblib.load(scaler_path)
    return model, scaler, checkpoint["features"]


def predict_lstm(symbol: str, df: Optional[pd.DataFrame] = None) -> Optional[float]:
    """
    Generate LSTM prediction probability for the latest data.
    Returns probability of price going up (0-1), or None if unavailable.
    """
    if not HAS_TORCH:
        return None

    loaded = load_lstm(symbol)
    if loaded is None:
        return None

    model, scaler, features = loaded

    if df is None:
        stock_df = get_stock_df(symbol)
        df = calculate_all_indicators(stock_df)

    if df.empty or len(df) < SEQUENCE_LENGTH:
        return None

    available = [c for c in features if c in df.columns]
    if len(available) != len(features):
        return None

    # Get last SEQUENCE_LENGTH rows
    X = df[available].tail(SEQUENCE_LENGTH).values
    X_scaled = scaler.transform(X)
    X_tensor = torch.FloatTensor(X_scaled).unsqueeze(0)  # Add batch dim

    with torch.no_grad():
        prob = model(X_tensor).item()

    return prob


def train_all_lstm(symbols: Optional[list] = None) -> dict:
    """Train LSTM models for all or specified stocks."""
    if not HAS_TORCH:
        return {"error": "PyTorch not installed"}

    from config import NIFTY_50_STOCKS
    if symbols is None:
        symbols = NIFTY_50_STOCKS

    results = {}
    for symbol in symbols:
        try:
            metrics = train_lstm(symbol)
            results[symbol] = metrics or {"error": "Training failed"}
        except Exception as e:
            logger.error("LSTM training failed for %s: %s", symbol, e)
            results[symbol] = {"error": str(e)}

    return results
