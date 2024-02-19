import { GenericArrowType, StatusEffectConst } from "webgl-test-shared";

export interface ArrowStatusEffectInfo {
   readonly type: StatusEffectConst;
   readonly durationTicks: number;
}

export class ArrowComponent {
   public readonly type: GenericArrowType;
   public readonly throwerID: number;
   public readonly damage: number;
   public readonly knockback: number;
   public readonly ignoreFriendlyBuildings: boolean;
   // @Speed: Polymorphism
   public readonly statusEffect: ArrowStatusEffectInfo | null;

   constructor(throwerID: number, type: GenericArrowType, damage: number, knockback: number, ignoreFriendlyBuildings: boolean, statusEffect: ArrowStatusEffectInfo | null) {
      this.type = type;
      this.throwerID = throwerID;
      this.damage = damage;
      this.knockback = knockback;
      this.ignoreFriendlyBuildings = ignoreFriendlyBuildings;
      this.statusEffect = statusEffect;
   }
}