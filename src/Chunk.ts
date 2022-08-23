import Entity from "./entities/Entity";

class Chunk {
   private readonly entities = new Array<Entity>();

   public addEntity(entity: Entity): void {
      this.entities.push(entity);
   }

   public removeEntity(entity: Entity): void {
      const idx = this.entities.indexOf(entity);
      this.entities.splice(idx, 1);
   }

   public getEntities(): Array<Entity> {
      return this.entities;
   }
}

export default Chunk;