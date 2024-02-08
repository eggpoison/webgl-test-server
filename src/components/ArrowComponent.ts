import { GenericArrowType } from "webgl-test-shared";

export class ArrowComponent {
   public readonly type: GenericArrowType;
   public readonly throwerID: number;
   public readonly damage: number;
   public readonly knockback: number;
   public readonly ignoreFriendlyBuildings: boolean;

   constructor(throwerID: number, type: GenericArrowType, damage: number, knockback: number, ignoreFriendlyBuildings: boolean) {
      this.type = type;
      this.throwerID = throwerID;
      this.damage = damage;
      this.knockback = knockback;
      this.ignoreFriendlyBuildings = ignoreFriendlyBuildings;
   }
}