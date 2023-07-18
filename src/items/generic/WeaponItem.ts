import { ItemType, WeaponItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";
import Mob from "../../entities/mobs/Mob";
import { MOB_ENTITY_TYPES } from "../../entity-classes";

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