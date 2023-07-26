import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";

class PickaxeItem extends ToolItem {
   public getAttackDamage(entityToAttack: Entity): number {
      if (entityToAttack.type === "boulder") {
         return this.damage;
      } else {
         return Math.ceil(this.damage / 2);
      }
   }
}

export default PickaxeItem