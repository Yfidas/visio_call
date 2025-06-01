import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './call.component.html',
  styleUrls: ['./call.component.css'],
})
export class CallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  username = '';
  connected = false;

  socket!: Socket;
  localStream!: MediaStream;
  peerConnection!: RTCPeerConnection;

  remoteSocketId = '';
  incomingCall = false;

  messages: { from?: string; content: string; type: 'system' | 'me' | 'user' }[] = [];
  newMessage = '';

  ngOnInit() {
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      console.log('Socket connected, id:', this.socket.id);
    });

    this.socket.on('user-connected', (username: string) => {
      this.messages.push({ content: `${username} s'est connecté.`, type: 'system' });
    });

    this.socket.on('user-disconnected', (username: string) => {
      this.messages.push({ content: `${username} s'est déconnecté.`, type: 'system' });
    });

    this.socket.on('message', (data: { from: string; message: string }) => {
      if (data.from !== this.username) {
        this.messages.push({ from: data.from, content: data.message, type: 'user' });
      }
    });

    this.socket.on('call-made', async (data: any) => {
      this.incomingCall = true;
      this.remoteSocketId = data.from;
      await this.setupPeerConnection();

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('make-answer', {
        answer,
        to: this.remoteSocketId,
      });
    });

    this.socket.on('answer-made', async (data: any) => {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    this.socket.on('ice-candidate', async (data: any) => {
      if (data.candidate) {
        try {
          await this.peerConnection.addIceCandidate(data.candidate);
        } catch (e) {
          console.error('Erreur ajout ICE candidate', e);
        }
      }
    });
  }

  ngOnDestroy() {
    this.socket.disconnect();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
  }

  async login() {
    if (!this.username) return alert('Entrer un nom');
    this.connected = true;
    this.socket.emit('join', this.username);
    await this.initLocalStream();
  }

  async initLocalStream() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localVideo.nativeElement.srcObject = this.localStream;
    } catch (e: any) {
      alert(`Erreur accès caméra/microphone : ${e.name} - ${e.message}`);
      console.error('Erreur getUserMedia:', e);
    }
  }

  async setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      this.remoteVideo.nativeElement.srcObject = event.streams[0];
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: this.remoteSocketId,
        });
      }
    };
  }

  async callUser() {
    if (!this.remoteSocketId) return alert('Entrer l’ID utilisateur à appeler');
    await this.setupPeerConnection();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.socket.emit('call-user', {
      offer,
      to: this.remoteSocketId,
    });
  }

  async sendMessage() {
    if (!this.newMessage) return;
    this.socket.emit('message', { from: this.username, message: this.newMessage });
    this.messages.push({ content: this.newMessage, type: 'me' });
    this.newMessage = '';
  }
}
