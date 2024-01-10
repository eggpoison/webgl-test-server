import { Item } from "webgl-test-shared";

export class ThrowingProjectileComponent {
   readonly tribeMemberID: number;
   readonly item: Item;

   constructor(tribeMemberID: number, item: Item) {
      this.tribeMemberID = tribeMemberID;
      this.item = item;
   }
}