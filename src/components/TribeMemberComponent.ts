import { TribeMemberComponentData, TribeType, randInt } from "webgl-test-shared";
import Entity from "../Entity";
import { TribeMemberComponentArray } from "./ComponentArray";

export class TribeMemberComponent {
   public readonly warPaintType: number;

   public readonly fishFollowerIDs = new Array<number>();

   constructor(tribeType: TribeType) {
      if (tribeType === TribeType.goblins) {
         this.warPaintType = randInt(1, 5);
      } else {
         this.warPaintType = -1;
      }
   }
}

export function serialiseTribeMemberComponent(entity: Entity): TribeMemberComponentData {
   const tribeMemberComponent = TribeMemberComponentArray.getComponent(entity.id);
   return {
      warPaintType: tribeMemberComponent.warPaintType
   };
}