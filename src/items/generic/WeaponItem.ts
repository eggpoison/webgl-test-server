import { ItemType, WeaponItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";
import Mob from "../../entities/mobs/Mob";

class WeaponItem extends ToolItem implements WeaponItemInfo {
   public readonly toolType: "weapon";

   constructor(itemType: ItemType, count: number, itemInfo: WeaponItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      // If the entity is a mob or a tribe member
      if (entityToAttack instanceof Mob || entityToAttack.hasOwnProperty("tribe")) {
         return this.damage;
      }
      return 1;
   }
}

export default WeaponItem;