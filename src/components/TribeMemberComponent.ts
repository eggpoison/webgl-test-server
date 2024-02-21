import { TribeType, randInt } from "webgl-test-shared";

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