import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorator/roles.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get(Roles, context.getHandler());
    if (!roles) {
      return true;
    }
    const gqlContext = GqlExecutionContext.create(context);
    const { req } = gqlContext.getContext();

    const accessToken = req.headers.accesstoken as string;
    const refreshToken = req.headers.refreshtoken as string;

    if (!accessToken || !refreshToken) {
      throw new UnauthorizedException('Please login to access this resource!');
    }

    try {
      const decodedAccessToken = this.jwtService.verify(accessToken, {
        secret: this.config.get<string>('ACCESS_TOKEN_SECRET'),
      });

      req.user = await this.prisma.user.findUnique({
        where: { id: decodedAccessToken.id },
      });

      req.accesstoken = accessToken;
      req.refreshtoken = refreshToken;
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        // Access token expired, update it using refresh token
        await this.updateAccessToken(req);
      } else {
        throw new UnauthorizedException('Invalid access token!');
      }
    }

    if (!roles.includes(req.user.role)) {
      throw new UnauthorizedException('Forbidden resource');
    }

    return true;
  }

  private async updateAccessToken(req: any): Promise<void> {
    try {
      const refreshTokenData = req.headers.refreshtoken as string;

      const decodedRefreshToken = this.jwtService.verify(refreshTokenData, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: decodedRefreshToken.id },
      });

      if (!user) {
        throw new UnauthorizedException('User not found!');
      }

      const accessToken = this.jwtService.sign(
        { id: user.id },
        {
          secret: this.config.get<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: '5m',
        },
      );

      req.user = user;
      req.accesstoken = accessToken;
      req.refreshtoken = refreshTokenData; // Keep the original refresh token
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token!');
    }
  }
}
