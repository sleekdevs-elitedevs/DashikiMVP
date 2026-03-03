# Video Calling Verification Implementation

## Tasks:
- [x] Analyze project structure and understand requirements
- [x] Update video-calling-utilities.ts with Stream Video client setup
- [x] Create app/challenge/verify/[id].tsx - Video verification page for creator
- [x] Create app/challenge/call/[id].tsx - Incoming call page for participants
- [x] Update challenge detail page with creator/participant logic
- [x] Implement real Stream Video SDK functionality

## Implementation Summary:

### 1. video-calling-utilities.ts
- Stream Video client creation utility
- Call management functions (createOrJoinCall, joinCall, leaveCall)
- Media controls (toggleMic, toggleCamera, switchCamera)
- Device hardware check functions
- Call ID generation utilities
- Exports STREAM_API_KEY for configuration

### 2. app/challenge/verify/[id].tsx (Creator's verification page)
- Creates/starts a Stream Video call for verification
- Camera/microphone permission handling
- Pre-call view with instructions
- Active call view with controls:
  - Mute/unmute microphone
  - Toggle video on/off
  - Switch camera
  - End call
- Duration timer tracking
- Minimum 30-second verification requirement
- Integration with proofs API to record verification
- Token fetching from backend (placeholder endpoint)

### 3. app/challenge/call/[id].tsx (Participant's incoming call page)
- Incoming call UI with ringing animation
- Accept/Decline call buttons
- Joins existing Stream Video call
- Active call view with controls:
  - Mute/unmute microphone
  - Toggle video on/off
  - Switch camera
  - End call
- Duration timer tracking
- Minimum 30-second verification requirement
- Integration with proofs API to record verification

### 4. app/challenge/[id].tsx (Challenge Detail)
- Shows "Creator" badge for challenge creators
- **Creator**: Sees "Start Verification Call" button (purple)
- **Participant**: Sees both "Submit Proof" and "Check for Call / Join" buttons

## Configuration Required:

### 1. Get Stream API Key
- Sign up at https://getstream.io/
- Create a new app and get your API key
- Replace `YOUR_STREAM_API_KEY` in `video-calling-utilities.ts`

### 2. Set Up Backend Token Generation
Create an API endpoint (e.g., `/api/stream-token`) that generates tokens:

```
javascript
// Example backend code (Node.js)
import Stream from 'getstream';

const client = Stream.connect('API_KEY', 'API_SECRET');

export function generateStreamToken(userId, userName) {
  return client.createToken(userId, name: userName);
}
```

### 3. Update the Token Fetch
In both `verify/[id].tsx` and `call/[id].tsx`, update the `getStreamToken` function to call your backend:

```
javascript
const getStreamToken = async (userId: string, userName: string): Promise<string> => {
  const response = await fetch('YOUR_BACKEND_URL/api/stream-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName }),
  });
  
  const data = await response.json();
  return data.token;
};
```

## How It Works:

### For Challenge Creators:
1. Navigate to a challenge you created
2. Click "Start Verification Call"
3. The call is created and participants can join
4. Verify participants as they join
5. End the call to save verification proof

### For Participants:
1. Navigate to a challenge you're participating in  
2. Click "Check for Call / Join"
3. Accept the incoming verification call
4. Show yourself completing the challenge
5. Stay on call for at least 30 seconds
6. End the call to submit your proof
