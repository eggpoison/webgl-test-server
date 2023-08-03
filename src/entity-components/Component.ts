import { GameObjectDebugData } from "webgl-test-shared";
import Entity from "../entities/Entity";

abstract class Component {
   protected entity!: Entity;
 
   public setEntity(entity: Entity): void {
      this.entity = entity;
   }

   public tick?(): void;

   public onLoad?(): void;

   public addDebugData?(debugData: GameObjectDebugData): void;
}

export default Component;