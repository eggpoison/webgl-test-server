import Board from "./Board";
import { Point } from "webgl-test-shared";
import Cow from "./entities/mobs/Cow";
import { getEntityCount } from "./census";
import { SERVER } from "./server";

test("Entities can be added to the census", () => {
   SERVER;

   const numEntitiesBefore = getEntityCount("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position, true);

   Board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore + 1);

   // Clean up
   cow.remove();
   Board.forceRemoveGameObject(cow);
});

test("Entities can be removed from the census", () => {
   SERVER;

   const position = new Point(200, 200);
   const cow = new Cow(position, true);

   Board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesBefore = getEntityCount("cow");

   cow.remove();
   Board.forceRemoveGameObject(cow);

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore - 1);
});

test("Entities which aren't naturally spawned aren't counted towards the census", () => {
   SERVER;

   const numEntitiesBefore = getEntityCount("cow");

   const position = new Point(200, 200);
   const cow = new Cow(position, false);

   Board.forcePushGameObjectFromJoinBuffer(cow);

   const numEntitiesAfter = getEntityCount("cow");

   expect(numEntitiesAfter).toEqual(numEntitiesBefore);

   // Clean up
   cow.remove();
   Board.forceRemoveGameObject(cow);
});