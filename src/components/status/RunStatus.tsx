import { Badge } from "@/components/ui/badge";
import {
  RUN_STATUS_LABEL,
  type RunStatusValue,
} from "./run-status-meta";

const STATUS_VARIANT: Record<
  RunStatusValue,
  "secondary" | "purple" | "success" | "destructive"
> = {
  draft: "secondary",
  submitted: "purple",
  signed: "success",
  voided: "destructive",
};

export function RunStatusBadge({
  status,
  className,
}: {
  status: RunStatusValue;
  className?: string;
}) {
  const variant = STATUS_VARIANT[status];
  const label = RUN_STATUS_LABEL[status];
  const showDot = status === "submitted";

  return (
    <Badge variant={variant} className={className}>
      {showDot ? (
        <span className="mr-2 inline-flex items-center">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: "var(--color-brand)" }}
            aria-hidden
          />
        </span>
      ) : null}
      {label}
    </Badge>
  );
}
