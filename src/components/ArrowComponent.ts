import { ItemType } from "webgl-test-shared";

export class ArrowComponent {
   public readonly tribeMemberID: number;
   public readonly bowType: ItemType;

   constructor(tribeMemberID: number, arrowType: ItemType) {
      this.tribeMemberID = tribeMemberID;
      this.bowType = arrowType;
   }
}