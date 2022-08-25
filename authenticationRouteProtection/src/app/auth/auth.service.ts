import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { User } from "./user.model";

export interface AuthResponseData {
    idToken: string;
    email: string;
    refreshToken: string;
    expiresIn: string;
    localId: string;
    registered?: boolean;
}

@Injectable({providedIn: 'root'})
export class AuthService {
    user = new BehaviorSubject<User | null>(null); 
    private tokenExiprationTimer: any;

    constructor(
        private http: HttpClient,
        private router: Router
    ) {}

    autoLogin() {
        const userData: {
            email: string,
            id: string,
            _token: string,
            _tokenExpirationDate: string
        } = JSON.parse(localStorage.getItem('userData') as string);
        if(!userData) {
            return;
        }

        const loadedUser = new User(
            userData.email, 
            userData.id, 
            userData._token, 
            new Date(userData._tokenExpirationDate)
        );

        if(loadedUser.token) {
            this.user.next(loadedUser);
            const expirationDuration = 
            new Date(userData._tokenExpirationDate).getTime() - 
            new Date().getTime();
            this.autoLogout(expirationDuration);
        }
    }

    logout() {
        this.user.next(null);
        this.router.navigate(['/auth']);
        localStorage.removeItem('userData');

        if(this.tokenExiprationTimer) {
            clearTimeout(this.tokenExiprationTimer);
        }
        this.tokenExiprationTimer = null;
    }

    autoLogout(expirationDuration: number) {
        this.tokenExiprationTimer = setTimeout(() => {
            this.logout();
        }, expirationDuration);
    }

    onSignUp(email: string, password: string) {
        return this.http.post<AuthResponseData>(
        'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyD03muFkCYSnK2syUv63I2pGE-cqTnYtY8',
        {
            email: email,
            password: password,
            returnSecureToken: true
        }
        ).pipe(catchError(this.handleError), tap(responseData => {
            this.handleAuthentication(
                responseData.email, 
                responseData.localId,
                responseData.idToken,
                +responseData.expiresIn,
            )
        }))
    }

    onLogin(email: string, password: string) {
        return this.http.post<AuthResponseData>(
            'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD03muFkCYSnK2syUv63I2pGE-cqTnYtY8',
            {
                email: email,
                password: password,
                returnSecureToken: true
            }
        ).pipe(catchError(this.handleError), tap(responseData => {
            this.handleAuthentication(
                responseData.email, 
                responseData.localId,
                responseData.idToken,
                +responseData.expiresIn,
            )
        }))
    }

    private handleAuthentication(
        email: string,
        userId: string,
        token: string,
        expiresIn: number
    ) {
        const expirationDate = new Date(new Date().getTime() + expiresIn * 1000);   
        const user = new User(email, userId, token, expirationDate);
        this.user.next(user);
        this.autoLogout(expiresIn * 1000);
        localStorage.setItem('userData', JSON.stringify(user));
    }

    private handleError(errorResponse: HttpErrorResponse) {
        let errorMessage = 'An error occurred!';

        if(!errorResponse.error || !errorResponse.error.error) {
            return throwError(errorMessage);
        }
        switch(errorResponse.error.error.message) {
        case 'EMAIL_EXISTS':
            errorMessage = 'This email already exists!';
            break;
        case 'EMAIL_NOT_FOUND':
            errorMessage = 'This email does not exist!';
            break;
        case 'INVALID_PASSWORD':
            errorMessage = 'The password does not match!';
            break;
        }
        return throwError(errorMessage);
    }
}