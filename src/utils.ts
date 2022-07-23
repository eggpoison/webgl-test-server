export function randFloat (min: number, max: number): number {
   return Math.random() * (max - min) + min;
}

export class Point {
   public x: number;
   public y: number;

   constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
   }

   public add(other: Point): Point {
      return new Point(
         this.x + other.x,
         this.y + other.y
      );
   };

   public dot(other: Point): number {
      return this.x * other.x + this.y * other.y;
   }

   public distanceFrom(other: Point): number {
      const distance = Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
      return distance;
   }

   public angleBetween(other: Point): number {
      const angle = Math.atan2(other.y - this.y, other.x - this.x);
      return angle;
   }

   public convertToVector(other?: Point): Vector {
      const targetPoint = other || new Point(0, 0);

      const distance = this.distanceFrom(targetPoint);
      const angle = targetPoint.angleBetween(this);
      return new Vector(distance, angle);
   }
}

export class Vector {
   public magnitude: number;
   public direction: number;

   constructor(magnitude: number, direction: number) {
      this.magnitude = magnitude;
      this.direction = direction;
   }

   public convertToPoint(): Point {
      const x = Math.cos(this.direction) * this.magnitude;
      const y = Math.sin(this.direction) * this.magnitude;
      return new Point(x, y);
   }

   public add(other: Vector): Vector {
      return (this.convertToPoint().add(other.convertToPoint())).convertToVector();
   }

   public static randomUnitVector(): Vector {
      const theta = randFloat(0, 360);
      return new Vector(1, theta);
   }
}

const lerp = (start: number, end: number, amount: number): number => {
   return start * (1 - amount) + end * amount;
}
