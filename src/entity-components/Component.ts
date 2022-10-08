import { EntityType } from "webgl-test-shared";
import Entity from "../entities/Entity";

abstract class Component {
   protected entity!: Entity;
 
   public setEntity(entity: Entity): void {
      this.entity = entity;
   }

   public tick?(): void;

   public onLoad?(): void;
}

export default Component;