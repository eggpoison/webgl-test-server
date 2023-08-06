import Entity from "../../entities/Entity";
import WeaponItem from "../generic/WeaponItem";

class FleshSword extends WeaponItem {
   public damageEntity(entity: Entity): void {
      entity.applyStatusEffect("poisoned", 3);
   }
}

export default FleshSword;