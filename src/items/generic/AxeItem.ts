import { AxeItemInfo, ENTITY_INFO_RECORD, ItemType } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";

class AxeItem extends ToolItem implements AxeItemInfo {
   public readonly toolType: "axe";
   
   constructor(itemType: ItemType, count: number, itemInfo: AxeItemInfo) {
      super(itemType, count, itemInfo)

      this.toolType = itemInfo.toolType;
   }

   public getAttackDamage(entityToAttack: Entity): number {
      const entityToAttackInfo = ENTITY_INFO_RECORD[entityToAttack.type];

      if (entityToAttackInfo.category === "resource") {
         return this.damage;
      } else {
         return Math.ceil(this.damage / 2);
      }
   }
}

export default AxeItem;