#pragma once
#include <stdint.h>
// Generated from app/src/demo-team.json and demo-leaderboard.json. Fictional values only.
namespace Demo {
struct Team { uint16_t team_id; const char* name; uint16_t score; uint8_t rank; uint8_t games_played; uint8_t games_won; };
struct Standing { uint16_t id; const char* name; uint16_t score; uint8_t games_played; };
constexpr Team team = {1, "Demo Team", 850, 3, 12, 8};
constexpr Standing leaderboard[] = {
  {2, "Neon Knights", 1240, 12},
  {3, "Copper Comets", 980, 12},
  {1, "Demo Team", 850, 12},
  {4, "Pixel Patrol", 720, 12},
  {5, "Blue Circuit", 610, 12},
  {6, "Orange Orbit", 480, 12},
  {7, "Signal Squad", 350, 12},
  {8, "Byte Brigade", 220, 12},
  {9, "Cobalt Crew", 90, 12}
};
constexpr uint8_t rowCount = sizeof(leaderboard) / sizeof(leaderboard[0]);
}
