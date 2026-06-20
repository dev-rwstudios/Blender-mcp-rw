import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle } from "lucide-react";

interface ToolCallCardProps {
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
}

export default function ToolCallCard({ name, input, result, isError }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[#3A3A3A] bg-[#2A2A2A] text-sm my-1">
      <button
        className="flex items-center gap-2 w-full p-3 text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : result !== undefined ? (
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <Wrench className="w-4 h-4 text-[#EA7600] shrink-0 animate-pulse" />
        )}
        <span className="text-[#EA7600] font-mono font-medium">{name}</span>
        <span className="ml-auto text-gray-500">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#3A3A3A] p-3 space-y-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">Input</p>
            <pre className="text-xs text-gray-200 overflow-auto max-h-40 whitespace-pre-wrap">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Result</p>
              <pre
                className={`text-xs overflow-auto max-h-40 whitespace-pre-wrap ${
                  isError ? "text-red-300" : "text-gray-200"
                }`}
              >
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
