import { ItemType, BowItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";
import Mob from "../../entities/mobs/Mob";

class BowItem extends ToolItem implements BowItemInfo {
   public readonly toolType: "bow";

   public readonly projectileDamage: number;
   public readonly projectileKnockback: number;
   public readonly projectileAttackCooldown: number;

   constructor(itemType: ItemType, count: number, itemInfo: BowItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
      this.projectileDamage = itemInfo.projectileDamage;
      this.projectileKnockback = itemInfo.projectileKnockback;
      this.projectileAttackCooldown = itemInfo.projectileAttackCooldown;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      // If the entity is a mob or a tribe member
      if (entityToAttack instanceof Mob || entityToAttack.hasOwnProperty("tribe")) {
         return this.damage;
      }
      return 1;
   }
}

export default BowItem;