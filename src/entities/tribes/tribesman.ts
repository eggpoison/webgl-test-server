import { IEntityType, Point, TribeType } from "webgl-test-shared";
import Entity from "../../GameObject";
import Tribe from "../../Tribe";
import { TribeComponentArray } from "../../components/ComponentArray";

export function createTribesman(position: Point, tribeType: TribeType, tribe: Tribe): Entity {
   const tribesman = new Entity(position, IEntityType.tribesman);
   
   TribeComponentArray.addComponent(tribesman, {
      tribeType: tribeType,
      tribe: tribe
   });
   
   return tribesman;
}