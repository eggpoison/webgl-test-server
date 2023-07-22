import { Point } from "webgl-test-shared";
import { SERVER } from "./server"
import Cow from "./entities/mobs/Cow";
import { MIN_SPAWN_DISTANCE, spawnPositionIsValid } from "./entity-spawning";

test("Entities can't be spawned too close to each other", () => {
   SERVER;

   const position = new Point(200, 200);
   const cow = new Cow(position);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   expect(spawnPositionIsValid(position)).toBe(false);
});

test("Entities can be spawned far away from each other", () => {
   SERVER;

   const position1 = new Point(200, 200);
   const cow = new Cow(position1);

   SERVER.board.forcePushGameObjectFromJoinBuffer(cow);

   const position2 = new Point(position1.x + MIN_SPAWN_DISTANCE + 10, position1.y);
   expect(spawnPositionIsValid(position2)).toBe(true);
})