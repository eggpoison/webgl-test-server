import { ItemType, WeaponItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem, { MOB_ENTITY_TYPES } from "./ToolItem";

class WeaponItem extends ToolItem implements WeaponItemInfo {
   public readonly toolType: "weapon";

   constructor(itemType: ItemType, count: number, itemInfo: WeaponItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      if (MOB_ENTITY_TYPES.includes(entityToAttack.type)) {
         return this.damage;
      }
      return 1;
   }
}

export default WeaponItem;