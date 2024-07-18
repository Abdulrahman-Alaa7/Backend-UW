import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ActivationResponse,
  ForgotPasswordResponse,
  GetUserByIdResponse,
  LoginResponse,
  LogoutResposne,
  MessageResponse,
  RegisterResponse,
  ResetPasswordResponse,
  UpdatePasswordResponse,
  UpdateProfileUserResponse,
  UpdateUserProfilePicResponse,
  UserResponse,
} from './types/user.types';
import {
  ActivationDto,
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  UpdateProfileUserDto,
  UpdateUserByIdForCreatorsDto,
  UpdateUserProfilePicDto,
} from './dto/user.dto';
import { Response } from 'express';
import { AuthGuard } from './guards/auth.guard';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Roles } from './decorator/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@Resolver('User')
// @UseFilters
export class UsersResolver {
  constructor(private readonly userService: UsersService) {}

  @Mutation(() => RegisterResponse)
  @UseGuards(AuthGuard)
  async register(
    @Args('registerDto') registerDto: RegisterDto,
    @Context() context: { res: Response },
  ): Promise<RegisterResponse> {
    if (!registerDto.name || !registerDto.email || !registerDto.password) {
      throw new BadRequestException('Please fill the all fields');
    }

    const { activation_token } = await this.userService.register(
      registerDto,
      context.res,
    );

    return { activation_token };
  }

  @Mutation(() => ActivationResponse)
  @UseGuards(AuthGuard)
  async activateUser(
    @Args('activationDto') activationDto: ActivationDto,
    @Context() context: { res: Response },
  ): Promise<ActivationResponse> {
    return await this.userService.activateUser(activationDto, context.res);
  }

  @Mutation(() => LoginResponse)
  async Login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<LoginResponse> {
    return await this.userService.Login({ email, password });
  }

  @Query(() => LoginResponse)
  @UseGuards(AuthGuard)
  async getLoggedInUser(@Context() context: { req: Request }) {
    return await this.userService.getLoggedInUser(context.req);
  }

  @Mutation(() => ForgotPasswordResponse)
  async forgotPassword(
    @Args('forgotPasswordDto') forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    return await this.userService.forgotPassword(forgotPasswordDto);
  }

  @Mutation(() => ResetPasswordResponse)
  async resetPassword(
    @Args('resetPasswordDto') resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    return await this.userService.resetPassword(resetPasswordDto);
  }

  @Query(() => LogoutResposne)
  @UseGuards(AuthGuard)
  async logOutUser(@Context() context: { req: Request }) {
    return await this.userService.Logout(context.req);
  }

  @Query(() => [User])
  @UseGuards(AuthGuard)
  @Roles(['Manager'])
  @UseGuards(RolesGuard)
  async getUsers() {
    return this.userService.getUsers();
  }

  @Mutation(() => UpdatePasswordResponse)
  @UseGuards(AuthGuard)
  async updatePassword(
    @Args('updatePasswordDto') updatePasswordDto: UpdatePasswordDto,
    @Context() context: { req: Request },
  ): Promise<UpdatePasswordResponse> {
    return await this.userService.updatePassword(
      context.req,
      updatePasswordDto,
    );
  }

  @Mutation(() => UpdateProfileUserResponse)
  @UseGuards(AuthGuard)
  async updateProfile(
    @Args('updateProfileUserDto')
    updateProfileUserDto: UpdateProfileUserDto,
    @Context() context: { req: Request },
  ): Promise<UpdateProfileUserResponse> {
    if (!updateProfileUserDto.name) {
      throw new BadRequestException('Please fill the required field (name)');
    }

    return await this.userService.updateProfileUser(
      context.req,
      updateProfileUserDto,
    );
  }

  @Mutation(() => UpdateUserProfilePicResponse)
  @UseGuards(AuthGuard)
  async updateUserProfilePic(
    @Args('updateUserProfilePicDto')
    updateUserProfilePicDto: UpdateUserProfilePicDto,
    @Context() context: { req: Request },
  ): Promise<UpdateUserProfilePicResponse> {
    return await this.userService.updateUserProfilePic(
      context.req,
      updateUserProfilePicDto,
    );
  }

  @Query(() => GetUserByIdResponse)
  @UseGuards(AuthGuard)
  @Roles(['Manager'])
  @UseGuards(RolesGuard)
  async getUserById(
    @Args('userId')
    userId: string,
  ): Promise<GetUserByIdResponse> {
    return await this.userService.getUserById(userId);
  }

  @Mutation(() => UserResponse)
  @UseGuards(AuthGuard)
  @Roles(['Manager'])
  @UseGuards(RolesGuard)
  async updateUserByIdForCreators(
    @Args('updateUserByIdForCreatorsDto')
    updateUserByIdForCreatorsDto: UpdateUserByIdForCreatorsDto,
  ): Promise<UserResponse> {
    return await this.userService.updateUserByIdForCreators(
      updateUserByIdForCreatorsDto,
    );
  }

  @Mutation(() => MessageResponse)
  @UseGuards(AuthGuard)
  @Roles(['Manager'])
  @UseGuards(RolesGuard)
  async deleteUserById(
    @Args('userId')
    userId: string,
  ): Promise<MessageResponse> {
    return await this.userService.deleteUserById(userId);
  }
}
