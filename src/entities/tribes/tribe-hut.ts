import { Point } from "webgl-test-shared";
import Tribe from "../../Tribe";
import Entity, { IEntityType } from "../../GameObject";
import { TribeComponentArray } from "../../components/ComponentArray";

export function createTribeHut(position: Point, tribe: Tribe): Entity {
   const hut = new Entity(position, IEntityType.tribeHut);
   TribeComponentArray.addComponent(hut, {
      tribeType: tribe.tribeType,
      tribe: tribe
   });
   return hut;
}