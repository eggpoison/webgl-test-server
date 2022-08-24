import { EntityType } from "webgl-test-shared";
import Entity from "./entities/Entity";

class Chunk {
   private readonly entities = new Array<Entity<EntityType>>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addEntity(entity: Entity<EntityType>): void {
      this.entities.push(entity);
   }

   public removeEntity(entity: Entity<EntityType>): void {
      const idx = this.entities.indexOf(entity);
      this.entities.splice(idx, 1);
   }

   public getEntities(): Array<Entity<EntityType>> {
      return this.entities;
   }
}

export default Chunk;