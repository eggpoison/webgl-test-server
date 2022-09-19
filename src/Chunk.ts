import { EntityType } from "webgl-test-shared";
import Entity from "./entities/Entity";

class Chunk {
   private readonly entities = new Array<Entity>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addEntity(entity: Entity): void {
      this.entities.push(entity);
   }

   public removeEntity(entity: Entity): void {
      const idx = this.entities.indexOf(entity);
      this.entities.splice(idx, 1);
   }

   public hasEntity(entity: Entity): boolean {
      return this.entities.includes(entity);
   }

   public getEntities(): Array<Entity> {
      return this.entities;
   }
}

export default Chunk;