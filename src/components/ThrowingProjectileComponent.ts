import { Item, ThrowingProjectileComponentData } from "webgl-test-shared";
import Entity from "../Entity";

export class ThrowingProjectileComponent {
   readonly tribeMemberID: number;
   readonly item: Item;

   constructor(tribeMemberID: number, item: Item) {
      this.tribeMemberID = tribeMemberID;
      this.item = item;
   }
}

export function serialiseThrowingProjectileComponent(_entity: Entity): ThrowingProjectileComponentData {
   return {};
}