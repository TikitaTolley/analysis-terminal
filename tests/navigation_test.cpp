#include <cassert>
#include "../main/navigation.h"
#include "../main/demo_data.h"
int main() {
  constexpr uint8_t count = 5;
  for (uint8_t page = 0; page < count; ++page) {
    assert(navigatePage(page, count, false, false, false) == page);
    assert(navigatePage(page, count, true, true, false) == page);
    for (int mask = 0; mask < 4; ++mask)
      assert(navigatePage(page, count, mask & 1, mask & 2, true) == 0);
    auto next = navigatePage(page, count, false, true, false);
    assert(navigatePage(next, count, true, false, false) == page);
  }
  assert(navigatePage(0, count, true, false, false) == 4);
  assert(navigatePage(4, count, false, true, false) == 0);
  assert(navigatePage(0, 0, false, true, false) == 0);
  unsigned matches = 0;
  for (unsigned i = 0; i < Demo::rowCount; ++i) {
    const auto& row = Demo::leaderboard[i];
    if (i) assert(Demo::leaderboard[i - 1].score >= row.score);
    if (row.id == Demo::team.team_id) {
      ++matches;
      assert(row.score == Demo::team.score);
      assert(row.games_played == Demo::team.games_played);
      assert(i + 1 == Demo::team.rank);
    }
  }
  assert(matches == 1);
  assert(Demo::team.games_won <= Demo::team.games_played);
}
