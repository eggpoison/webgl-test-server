import { EntityType } from "webgl-test-shared";
import Entity from "../entities/Entity";

abstract class Component {
   protected entity!: Entity<EntityType>;

   public setEntity(entity: Entity<EntityType>): void {
      this.entity = entity;
   }

   public tick?(): void;

   public onLoad?(): void;
}

export default Component;