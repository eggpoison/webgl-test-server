import Entity from "./entities/Entity";
import ItemEntity from "./items/ItemEntity";

class Chunk {
   private readonly entities = new Set<Entity>();
   private readonly itemEntities = new Set<ItemEntity>();

   public readonly x: number;
   public readonly y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public addEntity(entity: Entity): void {
      this.entities.add(entity);
   }

   public removeEntity(entity: Entity): void {
      this.entities.delete(entity);
   }

   public hasEntity(entity: Entity): boolean {
      return this.entities.has(entity);
   }

   public getEntities(): Set<Entity> {
      return this.entities;
   }

   public addItemEntity(item: ItemEntity): void {
      this.itemEntities.add(item);
   }

   public removeItemEntity(item: ItemEntity): void {
      this.itemEntities.delete(item);
   }

   public getItemEntities(): Set<ItemEntity> {
      return this.itemEntities;
   }
}

export default Chunk;