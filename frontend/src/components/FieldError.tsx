import { CircleAlert } from "lucide-react";

export function FieldError({ message }: { message: string }) {
  return (
    <p className="field-error">
      <CircleAlert size={14} aria-hidden="true" />
      {message}
    </p>
  );
}
