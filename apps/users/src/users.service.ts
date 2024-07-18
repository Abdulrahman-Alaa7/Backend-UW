import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import {
  ActivationDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  UpdateProfileUserDto,
  UpdateUserByIdForCreatorsDto,
  UpdateUserProfilePicDto,
} from './dto/user.dto';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { EmailService } from './email/email.service';
import { TokenSender } from './utils/sendToken';
import { Gender, Role, Status, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import * as GraphQLUpload from 'graphql-upload/GraphQLUpload.js';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream } from 'fs';
import { join } from 'path';
import * as fs from 'fs';

interface UserData {
  name: string;
  email: string;
  password: string;
  gender: Gender;
  role: Role;
  status: Status;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // Register user service
  async register(registerDto: RegisterDto, response: Response) {
    const { name, email, password, gender, status, role } = registerDto;

    const isEmailExist = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (isEmailExist) {
      throw new BadRequestException('User already exist with this email!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user: any = {
      name,
      email,
      password: hashedPassword,
      gender,
      role,
      status,
    };

    const activationToken = await this.createActivationToken(user);

    const activationCode = activationToken.activationCode;

    const activation_token = activationToken.token;

    await this.emailService.sendMail({
      email,
      subject: 'Activate your account!',
      template: './activation-mail',
      name,
      activationCode,
    });

    return { activation_token, response };
  }

  // Create activation token
  async createActivationToken(user: UserData) {
    const activationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const token = this.jwtService.sign(
      {
        user,
        activationCode,
      },
      {
        secret: this.configService.get<string>('ACTIVATION_SECRET'),
        expiresIn: '5m',
      },
    );
    return { token, activationCode };
  }

  // Activation user
  async activateUser(activationDto: ActivationDto, response: Response) {
    const { activationToken, activationCode } = activationDto;

    const newUser: { user: UserData; activationCode: string } =
      this.jwtService.verify(activationToken, {
        secret: this.configService.get<string>('ACTIVATION_SECRET'),
      } as JwtVerifyOptions) as { user: UserData; activationCode: string };

    if (newUser.activationCode !== activationCode) {
      throw new BadRequestException('Invalid activation code');
    }

    const { name, email, password, gender, role, status } = newUser.user;

    const existUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existUser) {
      throw new BadRequestException('User already exist with this email!');
    }

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password,
        gender,
        role,
        status,
      },
    });

    return { user, response };
  }

  // Login service
  async Login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user && (await this.comparePassword(password, user.password))) {
      const tokenSender = new TokenSender(this.configService, this.jwtService);
      return tokenSender.sendToken(user);
    } else {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        error: {
          message: 'Invalid email or password',
        },
      };
    }
  }

  // Compare with hashed password
  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate forgot password link
  async generateForgotPasswordLink(user: User) {
    const forgotPasswordToken = this.jwtService.sign(
      {
        user,
      },
      {
        secret: this.configService.get<string>('FORGOT_PASSWORD_SECRET'),
        expiresIn: '5m',
      },
    );
    return forgotPasswordToken;
  }

  // Forgot password
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found with this email!');
    }
    const forgotPasswordToken = await this.generateForgotPasswordLink(user);

    const resetPasswordUrl =
      this.configService.get<string>('CLIENT_SIDE_URI') +
      `/en/reset-password?verify=${forgotPasswordToken}`;

    await this.emailService.sendMail({
      email,
      subject: 'Reset your Password!',
      template: './forgot-password',
      name: user.name,
      activationCode: resetPasswordUrl,
    });

    return { message: `Your forgot password request succesful!` };
  }

  // Reset password
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { password, activationToken } = resetPasswordDto;

    const decoded = await this.jwtService.decode(activationToken);

    if (!decoded || decoded?.exp * 1000 < Date.now()) {
      throw new BadRequestException('Invalid token!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.update({
      where: {
        id: decoded.user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return { user };
  }

  // get logged in user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getLoggedInUser(req: any) {
    const user = req.user;
    const refreshToken = req.refreshtoken;
    const accessToken = req.accesstoken;
    return { user, refreshToken, accessToken };
  }

  // Log out user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async Logout(req: any) {
    req.user = null;
    req.refreshtoken = null;
    req.accesstoken = null;
    return { message: 'Logged out successfully!' };
  }

  // Get all users service
  async getUsers() {
    return this.prisma.user.findMany({});
  }

  // Update Password User
  async updatePassword(req: any, updatePasswordDto: UpdatePasswordDto) {
    const { currentPassword, newPassword } = updatePasswordDto;
    const userId = req.user.id;
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Please enter old and new password!');
    }

    const userPass = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (userPass?.password === undefined) {
      throw new BadRequestException('Invalid user!');
    }

    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      userPass.password,
    );

    if (!isPasswordMatch) {
      throw new BadRequestException('Invalid current password!');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    return { user };
  }

  async updateProfileUser(
    req: any,
    updateProfileUserDto: UpdateProfileUserDto,
  ) {
    const { name, bio, dob, gender, address, phone_number } =
      updateProfileUserDto;
    const userId = req.user.id;

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
        bio,
        dob,
        gender,
        address,
        phone_number,
      },
    });
    return { user };
  }

  async updateUserProfilePic(
    req: any,
    updateUserProfilePicDto: UpdateUserProfilePicDto,
  ) {
    const { image } = updateUserProfilePicDto;
    const userId = req.user.id;
    const oldImageUrl = req.user?.image;

    let imageUrl;
    if (image) {
      if (oldImageUrl) {
        const imagePath = oldImageUrl.replace(`${process.env.APP_URL}/`, '');
        const fullImagePath = join(process.cwd(), 'public', imagePath);

        fs.unlink(fullImagePath, (err: any) => {
          if (err) {
            // console.error(`Error deleting image: ${err.message}`);
          } else {
            // console.log(`Image deleted successfully: ${fullImagePath}`);
          }
        });
      }
      imageUrl = await this.storeImageAndGetURL(image);
    } else {
      if (oldImageUrl) {
        const imagePath = oldImageUrl.replace(`${process.env.APP_URL}/`, '');
        const fullImagePath = join(process.cwd(), 'public', imagePath);

        fs.unlink(fullImagePath, (err: any) => {
          if (err) {
            // console.error(`Error deleting image: ${err.message}`);
          } else {
            // console.log(`Image deleted successfully: ${fullImagePath}`);
          }
        });
        imageUrl = null;
      } else {
        imageUrl = null;
      }
    }

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        image: imageUrl,
      },
    });
    return { user };
  }

  private async storeImageAndGetURL(file: GraphQLUpload): Promise<string> {
    const { createReadStream, filename } = await file;

    const uniqueFilename = `${uuidv4()}_${filename}`;
    const imagePath = join(
      process.cwd(),
      'public',
      'profilePic',
      uniqueFilename,
    );
    const imageUrl = `${process.env.APP_URL}/profilePic/${uniqueFilename}`;
    const readStream = createReadStream();
    readStream.pipe(createWriteStream(imagePath));

    return imageUrl; // Return the appropriate URL where the file can be accessed
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return { user };
  }

  async updateUserByIdForCreators(
    updateUserByIdForCreatorsDto: UpdateUserByIdForCreatorsDto,
  ) {
    const { userId, role, status } = updateUserByIdForCreatorsDto;

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role,
        status,
      },
    });

    return { user };
  }

  async deleteUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return { message: `User Deleted Successfully` };
  }
}
