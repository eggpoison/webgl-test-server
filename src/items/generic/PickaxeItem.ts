import { ENTITY_INFO_RECORD } from "webgl-test-shared";
import Entity from "../../entities/Entity";
import ToolItem from "./ToolItem";

class PickaxeItem extends ToolItem {
   public getAttackDamage(entityToAttack: Entity): number {
      const entityToAttackInfo = ENTITY_INFO_RECORD[entityToAttack.type];

      if (entityToAttackInfo.category === "resource") {
         return this.damage;
      } else {
         return Math.ceil(this.damage / 2);
      }
   }
}

export default PickaxeItem