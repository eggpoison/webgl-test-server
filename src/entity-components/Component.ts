import { EntityType } from "webgl-test-shared";
import Entity from "../entities/Entity";

abstract class Component {
   private entity!: Entity<EntityType>;

   public setEntity(entity: Entity<EntityType>): void {
      this.entity = entity;
   }

   protected getEntity(): Entity<EntityType> {
      return this.entity;
   }

   public tick?(): void;

   public onLoad?(): void;
}

export default Component;