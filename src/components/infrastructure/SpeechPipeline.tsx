import { motion } from "framer-motion";
import { ArrowDown, Cpu } from "lucide-react";

import { PIPELINE_STAGES, PLATFORM_SERVICES } from "@/features/infrastructure/pipeline";

/** Visual representation of the RTSP → intelligence speech pipeline. */
export function SpeechPipeline() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <ol className="space-y-2">
        {PIPELINE_STAGES.map((stage, index) => (
          <li key={stage.id}>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-4 ring-1 ring-primary/10"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{stage.label}</p>
                  <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {stage.transport}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{stage.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-primary/80">{stage.engine}</p>
              </div>
            </motion.div>
            {index < PIPELINE_STAGES.length - 1 && (
              <div className="flex justify-center py-1 text-muted-foreground">
                <ArrowDown className="size-3.5" />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Service architecture
        </p>
        {PLATFORM_SERVICES.map((service) => (
          <div
            key={service.name}
            className="flex items-start gap-2.5 rounded-lg border border-border bg-surface/50 px-3 py-2.5"
          >
            <Cpu className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium">{service.name}</p>
              <p className="text-[11px] text-muted-foreground">{service.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
