import Entity from "../../entities/Entity";
import ToolItem, { RESOURCE_ENTITY_TYPES } from "./ToolItem";

class PickaxeItem extends ToolItem {
   public getAttackDamage(entityToAttack: Entity): number {
      if (RESOURCE_ENTITY_TYPES.includes(entityToAttack.type)) {
         return this.damage;
      } else {
         return Math.ceil(this.damage / 2);
      }
   }
}

export default PickaxeItem