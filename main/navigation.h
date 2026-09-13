#pragma once
#include <stdint.h>

// One action per debounced press. Red wins over simultaneous navigation.
// Blue + white together cancel. Navigation wraps at both ends.
inline uint8_t navigatePage(uint8_t page, uint8_t count, bool previous,
                            bool next, bool reset) {
  if (count == 0 || reset) return 0;
  if (previous == next) return page;
  if (previous) return page == 0 ? count - 1 : page - 1;
  return (page + 1) % count;
}
