import Entity from "./entities/Entity";
import ItemEntity from "./items/ItemEntity";

class Chunk {
   private readonly entities = new Array<Entity>();
   private readonly items = new Array<ItemEntity>();

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

   public addItem(item: ItemEntity): void {
      this.items.push(item);
   }

   public removeItem(item: ItemEntity): void {
      this.items.splice(this.items.indexOf(item), 1);
   }

   public getItems(): Array<ItemEntity> {
      return this.items;
   }
}

export default Chunk;