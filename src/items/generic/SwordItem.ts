import { ItemType, SwordItemInfo } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";
import Mob from "../../entities/mobs/Mob";

class SwordItem extends ToolItem implements SwordItemInfo {
   public readonly toolType: "sword";

   constructor(itemType: ItemType, count: number, itemInfo: SwordItemInfo) {
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

export default SwordItem;