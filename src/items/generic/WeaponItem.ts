import { ENTITY_INFO_RECORD, ItemType, WeaponItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";

class WeaponItem extends ToolItem implements WeaponItemInfo {
   public readonly toolType: "weapon";

   constructor(itemType: ItemType, count: number, itemInfo: WeaponItemInfo) {
      super(itemType, count, itemInfo);

      this.toolType = itemInfo.toolType;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      const entityToAttackInfo = ENTITY_INFO_RECORD[entityToAttack.type];
      
      if (entityToAttackInfo.category !== "resource") {
         return this.damage;
      }
      return 1;
   }
}

export default WeaponItem;