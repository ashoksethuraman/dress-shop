export interface UpdateProfileBody {
  displayName?: string;
  phone?: string;
  photoURL?: string;
}

export interface SetAdminClaimBody {
  targetUid: string;
  isAdmin: boolean;
}

export interface SignupBody {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: "male" | "female";
  mobileNumber: string;
  address?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

/** Authenticated user payload extracted from a verified HS256 JWT. */
export interface AuthUserPayload {
  uid: string;
  email: string;
  name: string;
  role: string;
}
