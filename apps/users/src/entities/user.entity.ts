import { ObjectType, Field, Directive } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields:"id")')
export class Avatars {
  @Field()
  id: string;

  @Field()
  public_id: string;

  @Field()
  url: string;

  @Field()
  userId: string;
}

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  password: string;

  @Field(() => Avatars, { nullable: true })
  avatar?: Avatars | null;

  @Field(() => String, { nullable: true })
  image: string;

  @Field()
  role: string;

  @Field({ nullable: true })
  bio: string;

  @Field({ nullable: true })
  address: string;

  @Field({ nullable: true })
  phone_number: number;

  @Field({ nullable: true })
  gender: string;

  @Field({ nullable: true })
  status: string;

  @Field({ nullable: true })
  dob: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
