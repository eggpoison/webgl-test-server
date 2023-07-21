import { AxeItemInfo, ItemType } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem, { RESOURCE_ENTITY_TYPES } from "./ToolItem";

class AxeItem extends ToolItem implements AxeItemInfo {
   public readonly toolType: "axe";
   
   constructor(itemType: ItemType, count: number, itemInfo: AxeItemInfo) {
      super(itemType, count, itemInfo)

      this.toolType = itemInfo.toolType;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      if (RESOURCE_ENTITY_TYPES.includes(entityToAttack.type)) {
         return this.damage;
      } else {
         return Math.ceil(this.damage / 2);
      }
   }
}

export default AxeItem;