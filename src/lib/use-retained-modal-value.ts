import { useEffect, useState } from "react";
import { usePresence } from "./use-presence";

/** Giữ dữ liệu trong nhịp đóng để khung không rỗng hoặc bị gỡ giữa animation. */
export function useRetainedModalValue<T>(value: T | null) {
  const [previous, setPrevious] = useState(value);
  const presence = usePresence(value !== null, 180);
  useEffect(() => {
    if (value !== null) setPrevious(value);
  }, [value]);
  return {
    value: value ?? (presence.mounted ? previous : null),
    open: value !== null,
  };
}
