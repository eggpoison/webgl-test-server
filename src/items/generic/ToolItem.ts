import { ItemType, ToolItemInfo, ToolType } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import Item from "./Item";

abstract class ToolItem extends Item implements ToolItemInfo {
   public readonly toolType: ToolType;

   public readonly damage: number;
   public readonly knockback: number;
   public readonly attackCooldown: number;

   constructor(itemType: ItemType, count: number, itemInfo: ToolItemInfo) {
      super(itemType, count);

      this.toolType = itemInfo.toolType;

      this.damage = itemInfo.damage;
      this.knockback = itemInfo.knockback;
      this.attackCooldown = itemInfo.attackCooldown;
   }

   public abstract getAttackDamage(entityToAttack: Entity): number;
}

export default ToolItem;