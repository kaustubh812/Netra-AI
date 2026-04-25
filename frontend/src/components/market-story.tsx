"use client";

import { useQuery } from "@tanstack/react-query";
import { api, MarketStory, StorySection, StoryDataPoint } from "@/lib/api";

const TONE_BORDER: Record<string, string> = {
  positive: "border-ngreen/25",
  negative: "border-nred/25",
  warning: "border-amber/25",
  neutral: "border-white/[0.08]",
};

const TONE_GLOW: Record<string, string> = {
  positive: "from-ngreen/[0.05] to-transparent",
  negative: "from-nred/[0.05] to-transparent",
  warning: "from-amber/[0.05] to-transparent",
  neutral: "from-cyan/[0.03] to-transparent",
};

const TONE_BADGE: Record<string, string> = {
  positive: "bg-ngreen/15 text-ngreen border-ngreen/30",
  negative: "bg-nred/15 text-nred border-nred/30",
  warning: "bg-amber/15 text-amber border-amber/30",
  neutral: "bg-white/[0.05] text-foreground/50 border-white/[0.08]",
};

const TONE_TEXT: Record<string, string> = {
  positive: "text-ngreen",
  negative: "text-nred",
  warning: "text-amber",
  neutral: "text-foreground/70",
};

const MOOD_LABEL: Record<string, string> = {
  positive: "Bullish bias",
  negative: "Bearish bias",
  warning: "Caution warranted",
  neutral: "Neutral",
};

function DataChip({ pt }: { pt: StoryDataPoint }) {
  return (
    <div className={`rounded-lg p-2.5 border ${TONE_BORDER[pt.tone]} bg-white/[0.02]`}>
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-foreground/45 text-[10px] uppercase tracking-wider truncate">{pt.label}</span>
        {pt.delta && <span className={`text-[10px] font-mono ${TONE_TEXT[pt.tone]}`}>{pt.delta}</span>}
      </div>
      <div className={`font-mono text-sm font-semibold ${TONE_TEXT[pt.tone]}`}>{pt.value}</div>
      {pt.meaning && (
        <div className="text-foreground/40 text-[10px] mt-1 leading-snug">{pt.meaning}</div>
      )}
    </div>
  );
}

function Section({ section, idx }: { section: StorySection; idx: number }) {
  if (section.data_points.length === 0 && !section.narrative) return null;

  return (
    <div
      className={`glass-card rounded-2xl p-5 border ${TONE_BORDER[section.tone]} relative overflow-hidden animate-fade-in`}
      style={{ animationDelay: `${idx * 0.05}s` }}
    >
      <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${TONE_GLOW[section.tone]} pointer-events-none`} />

      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{section.icon}</span>
          <h2 className="text-base font-semibold text-foreground/90">{section.title}</h2>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${TONE_BADGE[section.tone]}`}>
            {section.tone}
          </span>
        </div>

        <p className="text-foreground/70 text-sm leading-relaxed mb-4">{section.narrative}</p>

        {section.data_points.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {section.data_points.map((pt, i) => <DataChip key={i} pt={pt} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function HeadlineCard({ story }: { story: MarketStory }) {
  return (
    <div className={`glass-card-hero rounded-2xl p-6 border-2 ${TONE_BORDER[story.mood]} relative overflow-hidden animate-fade-in`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${TONE_GLOW[story.mood]} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest border ${TONE_BADGE[story.mood]}`}>
            Today · {MOOD_LABEL[story.mood]}
          </span>
          <span className="text-foreground/30 text-[10px] ml-auto">{story.generated_at}</span>
        </div>
        <h1 className={`text-2xl md:text-3xl font-bold ${TONE_TEXT[story.mood]} leading-tight`}>
          {story.headline}
        </h1>
        <p className="text-foreground/40 text-xs mt-2">
          A read on the market — what changed overnight, where money is flowing, and what to watch.
        </p>
      </div>
    </div>
  );
}

export function MarketStoryView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["market-story"],
    queryFn: api.getMarketStory,
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="glass-card rounded-2xl h-32 shimmer" />
        {[1, 2, 3, 4].map(i => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-foreground/40 text-sm">
        Could not load market story.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <HeadlineCard story={data} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.sections.map((sec, i) => <Section key={sec.id} section={sec} idx={i} />)}
      </div>
    </div>
  );
}
